"use client"

import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./select"
import { Input } from "./input"
import type { CountryCode } from 'libphonenumber-js'
import { useCallback, useMemo, useState } from 'react'
import { getCountryPhoneData, validatePhoneNumber, type CountryPhoneData } from '../../utils/country-phone-utils'

export interface PhoneInputProps {
  value: string
  countryCode: CountryCode
  onPhoneChange: (phone: string) => void
  onCountryChange: (country: CountryCode) => void
  onValidationChange?: (isInvalid: boolean) => void
  disabled?: boolean
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function PhoneInput({
  value,
  countryCode,
  onPhoneChange,
  onCountryChange,
  onValidationChange,
  disabled,
  placeholder = "Phone Number (optional)",
  onKeyDown,
}: PhoneInputProps) {
  const { priority, others } = useMemo(() => getCountryPhoneData(), [])
  const selectedCountry = useMemo(
    () => [...priority, ...others].find(c => c.code === countryCode),
    [countryCode, priority, others]
  )

  const [isInvalid, setIsInvalid] = useState(false)

  const digitCount = useCallback((val: string) => val.replace(/[^0-9]/g, '').length, [])

  const runValidation = useCallback((phone: string) => {
    if (!phone || digitCount(phone) === 0) {
      setIsInvalid(false)
      onValidationChange?.(false)
      return
    }
    const invalid = !validatePhoneNumber(phone, countryCode)
    setIsInvalid(invalid)
    onValidationChange?.(invalid)
  }, [countryCode, digitCount, onValidationChange])

  return (
    <div className="flex gap-2 w-full min-w-0">
      <Select
        value={countryCode}
        onValueChange={(val) => {
          onCountryChange(val as CountryCode)
          if (value) {
            setTimeout(() => runValidation(value), 0)
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
            {priority.map((country) => (
              <CountryOption key={country.code} country={country} />
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            {others.map((country) => (
              <CountryOption key={country.code} country={country} />
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input
        type="tel"
        value={value}
        onChange={(e) => {
          const val = e.target.value
          if (val === '' || /^[0-9\-() ]*$/.test(val)) {
            onPhoneChange(val)
            if (digitCount(val) > 4) {
              runValidation(val)
            } else if (digitCount(val) === 0) {
              setIsInvalid(false)
              onValidationChange?.(false)
            }
          }
        }}
        onBlur={() => runValidation(value)}
        disabled={disabled}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={`min-w-0 flex-1 ${isInvalid ? '!border-[var(--ods-attention-yellow-warning)]' : ''}`}
      />
    </div>
  )
}

function CountryOption({ country }: { country: CountryPhoneData }) {
  return (
    <SelectItem value={country.code} textValue={country.name}>
      <span className="flex items-center gap-2">
        <span className="shrink-0">{country.flag}</span>
        <span className="shrink-0 text-ods-text-secondary">{country.dialCode}</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px] inline-block">{country.name}</span>
      </span>
    </SelectItem>
  )
}
