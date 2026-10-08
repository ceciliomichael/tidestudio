import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  value: T;
  options: DropdownOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
};

export function Dropdown<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: Props<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((option) => option.value === value)),
    [options, value],
  );

  const selectedLabel = options[selectedIndex]?.label ?? value;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function focusOption(index: number) {
    const boundedIndex = Math.max(0, Math.min(index, options.length - 1));
    setActiveIndex(boundedIndex);

    requestAnimationFrame(() => {
      optionRefs.current[boundedIndex]?.focus();
    });
  }

  function openMenu() {
    setOpen(true);
    focusOption(selectedIndex);
  }

  function selectOption(option: DropdownOption<T>) {
    onChange(option.value);
    setOpen(false);

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index === options.length - 1 ? 0 : index + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index === 0 ? options.length - 1 : index - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    }
  }

  return (
    <div className="ui-dropdown" ref={rootRef}>
      <button
        className={open ? "ui-dropdown__trigger is-open" : "ui-dropdown__trigger"}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          className="ui-dropdown__chevron"
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="ui-dropdown__menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const selected = option.value === value;

            return (
              <button
                className={
                  index === activeIndex
                    ? "ui-dropdown__option is-active"
                    : "ui-dropdown__option"
                }
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onFocus={() => setActiveIndex(index)}
              >
                <span>{option.label}</span>
                {selected ? (
                  <Check size={13} strokeWidth={2} aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
