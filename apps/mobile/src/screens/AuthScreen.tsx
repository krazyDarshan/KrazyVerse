import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_URL, ApiClientError } from '../lib/api';
import {
  type AuthSession,
  login,
  persistSession,
  resendEmailOtp,
  signup,
  verifyEmailOtp,
} from '../lib/auth';

type AuthMode = 'login' | 'signup';

type Props = {
  onAuthenticated(session: AuthSession): void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [message, setMessage] = useState('Sign in to start using your KrazyVerse account.');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = normalizeUsername(username);
        const cleanDisplayName = displayName.trim();
        const validationError = validateSignupFields({
          email: cleanEmail,
          password,
          username: cleanUsername,
          displayName: cleanDisplayName,
        });

        if (validationError) {
          setError(validationError);
          return;
        }

        const result = await signup({
          email: cleanEmail,
          password,
          username: cleanUsername,
          displayName: cleanDisplayName,
        });
        setUsername(cleanUsername);
        setDisplayName(cleanDisplayName);
        setPendingSession(result);
        setDevOtp(result.devOtp);
        setMessage('Account created. Enter the 6-digit email code to verify this device.');
        return;
      }

      const result = await login({
        email: email.trim().toLowerCase(),
        password,
        totpCode: totpCode.trim() || undefined,
      });
      onAuthenticated(result);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!pendingSession) {
      setError('Create an account first, then verify the email OTP.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyEmailOtp(email.trim().toLowerCase(), otp.trim());
      const verifiedSession = {
        ...pendingSession,
        user: { ...pendingSession.user, emailVerifiedAt: new Date().toISOString() },
      };
      await persistSession(verifiedSession);
      onAuthenticated(verifiedSession);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await resendEmailOtp(email.trim().toLowerCase());
      setDevOtp(result.data?.devOtp);
      setMessage('A fresh verification code was sent.');
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.logo}>KrazyVerse</Text>
          <Text style={styles.tagline}>Create, post, remix, message, and monetize.</Text>
        </View>

        <View style={styles.segment}>
          <ModeButton label="Login" active={mode === 'login'} onPress={() => setMode('login')} />
          <ModeButton
            label="Sign up"
            active={mode === 'signup'}
            onPress={() => setMode('signup')}
          />
        </View>

        <Text style={styles.message}>{message}</Text>
        <Text style={styles.apiText}>API: {API_URL}</Text>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          {mode === 'signup' ? (
            <>
              <Field
                label="Username"
                value={username}
                onChangeText={(value) => setUsername(value.replace(/\s+/g, '.'))}
                autoCapitalize="none"
                placeholder="krazy.creator"
              />
              <Field
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Krazy Creator"
              />
            </>
          ) : null}
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={mode === 'signup' ? 'Password123' : 'Your password'}
          />
          {mode === 'signup' ? (
            <Text style={styles.helper}>
              Use 10+ chars with uppercase, lowercase, and a number.
            </Text>
          ) : (
            <Field
              label="2FA code"
              value={totpCode}
              onChangeText={setTotpCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Optional"
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={loading}
            style={[styles.primary, loading && styles.disabled]}
            onPress={submit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                {mode === 'signup' ? 'Create account' : 'Login'}
              </Text>
            )}
          </Pressable>
        </View>

        {pendingSession ? (
          <View style={styles.otpPanel}>
            <Text style={styles.panelTitle}>Verify email</Text>
            {devOtp ? <Text style={styles.devOtp}>Development OTP: {devOtp}</Text> : null}
            <Field
              label="6-digit code"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
            />
            <View style={styles.inlineActions}>
              <Pressable disabled={loading} style={styles.secondary} onPress={resendOtp}>
                <Text style={styles.secondaryText}>Resend</Text>
              </Pressable>
              <Pressable disabled={loading} style={styles.secondaryDark} onPress={verifyOtp}>
                <Text style={styles.secondaryDarkText}>Verify</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => onAuthenticated(pendingSession)}>
              <Text style={styles.skip}>Skip verification for now</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress(): void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        keyboardType={props.keyboardType}
        maxLength={props.maxLength}
        style={styles.input}
      />
    </View>
  );
}

function readError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 422) {
      return (
        readValidationDetails(error.details) ??
        'Check the form fields. Password needs uppercase, lowercase, number, and 10+ characters.'
      );
    }
    if (error.status === 409) {
      return 'That email or username already exists. Try logging in or choose another username.';
    }
    if (error.code === 'TWO_FACTOR_REQUIRED') {
      return 'This account needs the 6-digit authenticator code.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, '').replace(/\s+/g, '.').toLowerCase();
}

function validateSignupFields(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return 'Enter a valid email address.';
  }
  if (!/^[a-zA-Z0-9._]{3,30}$/.test(input.username)) {
    return 'Username must be 3-30 characters and can use letters, numbers, dots, and underscores. Do not include @.';
  }
  if (!input.displayName) {
    return 'Display name is required.';
  }
  if (input.displayName.length > 80) {
    return 'Display name must be 80 characters or less.';
  }
  if (input.password.length < 10) {
    return 'Password must be at least 10 characters.';
  }
  if (!/[A-Z]/.test(input.password)) {
    return 'Password must include one uppercase letter.';
  }
  if (!/[a-z]/.test(input.password)) {
    return 'Password must include one lowercase letter.';
  }
  if (!/[0-9]/.test(input.password)) {
    return 'Password must include one number.';
  }
  return null;
}

function readValidationDetails(details: unknown) {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const maybeDetails = details as {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  const messages = [
    ...Object.entries(maybeDetails.fieldErrors ?? {}).flatMap(([field, fieldMessages]) =>
      (fieldMessages ?? []).map((message) => `${field}: ${message}`),
    ),
    ...(maybeDetails.formErrors ?? []),
  ];

  return messages.length ? messages.join('\n') : null;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: '#f8fafc' },
  screen: { flexGrow: 1, padding: 18, justifyContent: 'center' },
  brandBlock: { marginBottom: 24 },
  logo: { color: '#111827', fontSize: 40, fontWeight: '900' },
  tagline: { color: '#475569', fontSize: 16, lineHeight: 23, marginTop: 8 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: '#e2e8f0', borderRadius: 8 },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: { backgroundColor: '#fff' },
  modeText: { color: '#64748b', fontWeight: '900' },
  modeTextActive: { color: '#111827' },
  message: { color: '#334155', lineHeight: 21, marginTop: 18 },
  apiText: { color: '#64748b', fontSize: 12, marginTop: 6 },
  form: { marginTop: 18, gap: 12 },
  field: { gap: 7 },
  label: { color: '#111827', fontWeight: '900' },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: '#111827',
  },
  helper: { color: '#64748b', lineHeight: 19 },
  error: { color: '#b91c1c', fontWeight: '800', lineHeight: 20 },
  primary: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  otpPanel: {
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  panelTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  devOtp: { color: '#0f766e', fontWeight: '900' },
  inlineActions: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#111827', fontWeight: '900' },
  secondaryDark: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDarkText: { color: '#fff', fontWeight: '900' },
  skip: { color: '#7c3aed', fontWeight: '900', textAlign: 'center', paddingVertical: 6 },
});
