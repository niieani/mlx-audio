"use client"

import type React from "react"

type RangeInputProps = {
  min: number
  max: number
  step: number
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
  ariaLabel?: string
}

export function RangeInput({
  min,
  max,
  step,
  value,
  onChange,
  className = "",
  ariaLabel,
}: RangeInputProps) {
  const percentage = ((value - Number(min)) / (Number(max) - Number(min))) * 100

  return (
    <div className={`relative flex-1 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full appearance-none bg-transparent cursor-pointer"
        aria-label={ariaLabel}
        style={{
          background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          height: "2px",
          borderRadius: "2px",
        }}
      />
    </div>
  )
}
