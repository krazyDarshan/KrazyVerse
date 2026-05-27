import { normalizeUsernameSeed } from './auth.service';
import { generateOtp, hashSecret, verifySecret } from '../../utils/security';

describe('auth module', () => {
  it('normalizes OAuth and phone username seeds safely', () => {
    expect(normalizeUsernameSeed('Darsh @ KrazyVerse!!')).toBe('darshkrazyverse');
    expect(normalizeUsernameSeed('a')).toBe('axx');
  });

  it('generates six digit OTPs', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('hashes and verifies secrets without storing raw values', async () => {
    const hash = await hashSecret('CorrectHorseBattery9');
    expect(hash).not.toBe('CorrectHorseBattery9');
    await expect(verifySecret('CorrectHorseBattery9', hash)).resolves.toBe(true);
    await expect(verifySecret('wrong', hash)).resolves.toBe(false);
  });
});
