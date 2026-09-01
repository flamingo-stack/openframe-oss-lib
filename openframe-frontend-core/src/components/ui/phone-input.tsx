'use client';

import type { CountryCode } from 'libphonenumber-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getCountryPhoneData, validatePhoneNumber, type CountryPhoneData } from '../../utils/country-phone-utils';
import { Input } from './input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './select';

export interface PhoneInputProps {
  value: string;
  countryCode: CountryCode;
  onPhoneChange: (phone: string) => void;
  onCountryChange: (country: CountryCode) => void;
  onValidationChange?: (isInvalid: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export function PhoneInput({
  value,
  countryCode,
  onPhoneChange,
  onCountryChange,
  onValidationChange,
  disabled,
  placeholder = 'Phone Number (optional)',
  onKeyDown,
}: PhoneInputProps) {
  const { priority, others } = useMemo(() => getCountryPhoneData(), []);
  const selectedCountry = useMemo(
    () => [...priority, ...others].find(c => c.code === countryCode),
    [countryCode, priority, others],
  );

  const [isInvalid, setIsInvalid] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const digitCount = useCallback((val: string) => val.replace(/[^0-9]/g, '').length, []);

  const runValidation = useCallback(
    (phone: string) => {
      if (!phone || digitCount(phone) === 0) {
        setIsInvalid(false);
        onValidationChange?.(false);
        return;
      }
      const invalid = !validatePhoneNumber(phone, countryCode);
      setIsInvalid(invalid);
      onValidationChange?.(invalid);
    },
    [countryCode, digitCount, onValidationChange],
  );

  const debouncedValidation = useCallback(
    (phone: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runValidation(phone), 300);
    },
    [runValidation],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex w-full min-w-0 gap-2">
      <Select
        value={countryCode}
        onValueChange={val => {
          onCountryChange(val as CountryCode);
          if (value) {
            debouncedValidation(value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue>
            {selectedCountry && (
              <span className="flex items-center gap-1.5">
                <span>{selectedCountry.flag}</span>
                <span>{selectedCountry.dialCode}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] !w-[280px]">
          <SelectGroup>
            {priority.map(country => (
              <CountryOption key={country.code} country={country} />
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            {others.map(country => (
              <CountryOption key={country.code} country={country} />
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input
        type="tel"
        value={value}
        onChange={e => {
          const val = e.target.value;
          if (val === '' || /^[0-9\-() ]*$/.test(val)) {
            onPhoneChange(val);
            if (digitCount(val) > 4) {
              debouncedValidation(val);
            } else if (digitCount(val) === 0) {
              setIsInvalid(false);
              onValidationChange?.(false);
            }
          }
        }}
        onBlur={() => runValidation(value)}
        disabled={disabled}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={`min-w-0 flex-1 ${isInvalid ? '!border-ods-warning' : ''}`}
      />
    </div>
  );
}

function CountryOption({ country }: { country: CountryPhoneData }) {
  return (
    <SelectItem value={country.code} textValue={country.name}>
      <span className="flex items-center gap-2">
        <span className="shrink-0">{country.flag}</span>
        <span className="shrink-0 text-ods-text-secondary">{country.dialCode}</span>
        <span className="inline-block max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
          {country.name}
        </span>
      </span>
    </SelectItem>
  );
}
