import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption<T extends string> = {
  label: string;
  value: T;
  badge?: string;
};

export function getDropdownNaturalHeight(
  scrollHeight: number,
  offsetHeight: number,
  clientHeight: number,
): number {
  // scrollHeight omits borders; max-height uses the border-box.
  // A pixel of allowance avoids a rounding-only scrollbar in short menus.
  return scrollHeight + (offsetHeight - clientHeight) + 1;
}

type Props<T extends string> = {
  value: T;
  options: DropdownOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
  menuClassName?: string;
  maxMenuHeight?: number;
  mode?: "select" | "action";
  disabled?: boolean;
};

export function Dropdown<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
  menuClassName = "",
  maxMenuHeight = 320,
  mode = "select",
  disabled = false,
}: Props<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({
    left: 0,
    top: 0,
    width: 160,
    maxHeight: maxMenuHeight,
  });

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((option) => option.value === value)),
    [options, value],
  );

  const selectedLabel = options[selectedIndex]?.label ?? value;
  // Keep a modal's menu in its overlay layer, outside the clipped dialog panel.
  const menuContainer = rootRef.current?.closest(".ui-modal-overlay") ?? document.body;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
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

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      const gap = mode === "action" ? 6 : 8;
      const width = Math.min(
        Math.max(mode === "action" ? 136 : 160, rect.width),
        Math.max(0, window.innerWidth - 2 * gap),
      );
      const left = Math.max(
        gap,
        Math.min(rect.right - width, window.innerWidth - width - gap),
      );
      const intrinsicHeight = getDropdownNaturalHeight(
        menu.scrollHeight,
        menu.offsetHeight,
        menu.clientHeight,
      );
      const height = Math.min(intrinsicHeight, maxMenuHeight);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 2 * gap);
      const spaceAbove = Math.max(0, rect.top - 2 * gap);
      const openAbove = height > spaceBelow && spaceAbove > spaceBelow;
      const maxHeight = Math.min(height, openAbove ? spaceAbove : spaceBelow);
      const top = openAbove
        ? rect.top - gap - maxHeight
        : rect.bottom + gap;

      setMenuPosition((current) => {
        if (
          current.left === left &&
          current.top === top &&
          current.width === width &&
          current.maxHeight === maxHeight
        ) {
          return current;
        }
        return { left, top, width, maxHeight };
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, maxMenuHeight, mode, options]);

  function focusOption(index: number) {
    const boundedIndex = Math.max(0, Math.min(index, options.length - 1));
    setActiveIndex(boundedIndex);

    requestAnimationFrame(() => {
      optionRefs.current[boundedIndex]?.focus();
    });
  }

  function openMenu(focusFirstOption = true) {
    setOpen(true);
    if (focusFirstOption) {
      focusOption(selectedIndex);
    } else {
      // Action menus opened by pointer should not pre-highlight the first item.
      // Keyboard opening still focuses the first option for navigation.
      setActiveIndex(-1);
    }
  }

  function selectOption(option: DropdownOption<T>) {
    onChange(option.value);
    setOpen(false);

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      return;
    }

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
    <div className={mode === "action" ? "ui-dropdown ui-dropdown--action" : "ui-dropdown"} ref={rootRef}>
      <button
        className={open ? "ui-dropdown__trigger is-open" : "ui-dropdown__trigger"}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup={mode === "action" ? "menu" : "listbox"}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => {
          if (open) {
            setOpen(false);
          } else {
            openMenu(mode !== "action" || event.detail === 0);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {mode === "select" ? <span>{selectedLabel}</span> : null}
        <ChevronDown
          className="ui-dropdown__chevron"
          size={mode === "action" ? 12 : 14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? createPortal(
        <div
          className={["ui-dropdown__menu", menuClassName].filter(Boolean).join(" ")}
          id={menuId}
          ref={menuRef}
          role={mode === "action" ? "menu" : "listbox"}
          aria-label={ariaLabel}
          style={menuPosition}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
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
                role={mode === "action" ? "menuitem" : "option"}
                aria-selected={mode === "select" ? selected : undefined}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onFocus={() => setActiveIndex(index)}
              >
                <span className="ui-dropdown__option-label">{option.label}</span>
                <span className="ui-dropdown__option-meta">
                  {option.badge ? (
                    <span className="ui-dropdown__badge">{option.badge}</span>
                  ) : null}
                  {mode === "select" && selected ? (
                    <Check size={13} strokeWidth={2} aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>,
        menuContainer,
      ) : null}
    </div>
  );
}
