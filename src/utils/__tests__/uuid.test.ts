import { describe, it, expect, vi } from 'vitest';
import { generateUUID, isValidUUID } from '../uuid';

describe('UUID utilities', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate UUIDs with correct format', () => {
      const uuid = generateUUID();
      const parts = uuid.split('-');
      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });

    it('should generate multiple unique UUIDs in sequence', () => {
      const uuids = Array.from({ length: 100 }, () => generateUUID());
      const uniqueUuids = new Set(uuids);
      expect(uniqueUuids.size).toBe(100);
    });

    it('should have version 4 indicator (4 in position 13)', () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    });

    it('should have variant indicator (8, 9, a, or b in position 17)', () => {
      const uuid = generateUUID();
      const variantChar = uuid[19].toLowerCase();
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4 format', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });

    it('should validate UUIDs with uppercase letters', () => {
      const validUUID = '550E8400-E29B-41D4-A716-446655440000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should reject UUIDs with wrong version', () => {
      const wrongVersion = '550e8400-e29b-11d4-a716-446655440000'; // version 1
      expect(isValidUUID(wrongVersion)).toBe(false);
    });

    it('should reject UUIDs with wrong variant', () => {
      const wrongVariant = '550e8400-e29b-41d4-c716-446655440000'; // variant c
      expect(isValidUUID(wrongVariant)).toBe(false);
    });

    it('should validate generated UUIDs', () => {
      for (let i = 0; i < 10; i++) {
        const uuid = generateUUID();
        expect(isValidUUID(uuid)).toBe(true);
      }
    });

    it('should handle edge cases', () => {
      expect(isValidUUID('00000000-0000-4000-8000-000000000000')).toBe(true);
      expect(isValidUUID('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true);
    });
  });
});
