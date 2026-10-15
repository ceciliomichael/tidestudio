#[tauri::command]
pub fn set_native_caption_color(
    window: tauri::Window,
    color: String,
    dark: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        apply_windows_caption_color(&window, &color, dark)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, color, dark);
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn apply_windows_caption_color(
    window: &tauri::Window,
    color: &str,
    dark: bool,
) -> Result<(), String> {
    use std::ffi::c_void;

    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            attribute: u32,
            value: *const c_void,
            value_size: u32,
        ) -> i32;
    }

    // DWM color attributes use COLORREF (0x00BBGGRR), not HTML RGB order.
    let rgb = color.strip_prefix('#').ok_or("invalid caption color")?;
    if rgb.len() != 6 {
        return Err("invalid caption color".into());
    }
    let parsed = u32::from_str_radix(rgb, 16).map_err(|_| "invalid caption color")?;
    let caption_color = ((parsed & 0xff) << 16) | (parsed & 0xff00) | (parsed >> 16);
    let text_color: u32 = if dark { 0x00eae9e9 } else { 0x00212220 };
    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as *mut c_void;

    // Windows 11 supports DWMWA_BORDER_COLOR (34), CAPTION_COLOR (35), and TEXT_COLOR (36).
    // Earlier Windows versions can reject these attributes; native theme remains the fallback.
    for (attribute, value) in [(34, caption_color), (35, caption_color), (36, text_color)] {
        // SAFETY: hwnd belongs to this window; DWM reads a 4-byte COLORREF for these attributes.
        unsafe {
            DwmSetWindowAttribute(
                hwnd,
                attribute,
                &value as *const u32 as *const c_void,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }

    Ok(())
}
