import React from 'react'

interface TestAndSaveButtonProps {
  isLoading: boolean
  isDisabled: boolean
  onClick: () => void
}

export default function TestAndSaveButton({
  isLoading,
  isDisabled,
  onClick,
}: TestAndSaveButtonProps): React.JSX.Element {
  const isInert = isLoading || isDisabled

  return (
    <button
      type="button"
      disabled={isInert}
      aria-busy={isLoading ? 'true' : 'false'}
      aria-label="Test and save API key"
      onClick={onClick}
      className={[
        'w-full h-11 rounded-md mt-3',
        'text-[0.875rem] font-semibold text-on-primary',
        'bg-gradient-to-br from-primary to-primary-container',
        'hover:brightness-96 active:brightness-92',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isInert ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="w-[14px] h-[14px] rounded-full border-2 border-white border-t-transparent animate-spin"
          />
          Validating…
        </span>
      ) : (
        'Test & save'
      )}
    </button>
  )
}
