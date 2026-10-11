use crate::AppState;
use std::{sync::atomic::Ordering, thread, time::Duration};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

#[cfg(windows)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(windows)]
use tauri::{PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{HWND, POINT, RECT},
    UI::{
        Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON},
        WindowsAndMessaging::{GetCursorPos, GetWindowRect},
    },
};

const MAIN_WINDOW: &str = "main";
const TRAY_WINDOW: &str = "tray";

#[cfg(windows)]
const POPUP_WIDTH: f64 = 184.0;
#[cfg(windows)]
const POPUP_HEIGHT: f64 = 69.0;
#[cfg(windows)]
const POPUP_OVERLAP: i32 = 10;

#[cfg(windows)]
fn tray_click_area(
    tray: (i32, i32, i32, i32),
    click: PhysicalPosition<f64>,
) -> (i32, i32, i32, i32) {
    // The Windows tray event rectangle may not cover the full clickable target.
    const CLICK_SLOP: i32 = 10;
    let click_x = click.x.round() as i32;
    let click_y = click.y.round() as i32;
    (
        tray.0.min(click_x.saturating_sub(CLICK_SLOP)),
        tray.1.min(click_y.saturating_sub(CLICK_SLOP)),
        tray.2.max(click_x.saturating_add(CLICK_SLOP)),
        tray.3.max(click_y.saturating_add(CLICK_SLOP)),
    )
}

#[cfg(windows)]
fn contains_point(bounds: (i32, i32, i32, i32), x: i32, y: i32) -> bool {
    x >= bounds.0 && x < bounds.2 && y >= bounds.1 && y < bounds.3
}

/// Keeps shutdown synchronous so no model worker or API gateway outlives the app.
pub fn shutdown(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.shutting_down.swap(true, Ordering::AcqRel) {
        return;
    }

    // Stop incoming requests and JIT actions before releasing worker resources.
    if let Ok(mut gateway) = state.gateway.lock() {
        gateway.shutdown();
    }
    if let Ok(mut servers) = state.servers.lock() {
        if let Err(error) = servers.stop_all() {
            eprintln!("failed to stop some llama-server processes: {error}");
        }
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    hide_tray_popup(&app);
    shutdown(&app);
    app.exit(0);
}

#[tauri::command]
pub fn toggle_window(app: AppHandle) -> Result<(), String> {
    hide_tray_popup(&app);
    let main = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or("main window missing")?;
    if main.is_visible().map_err(|error| error.to_string())? {
        main.hide().map_err(|error| error.to_string())?;
    } else {
        show_main(&app);
    }
    Ok(())
}

#[tauri::command]
pub fn tray_popup_visible(app: AppHandle) -> bool {
    app.state::<AppState>()
        .tray_popup_visible
        .load(Ordering::Acquire)
}

pub(crate) fn show_main(app: &AppHandle) {
    hide_tray_popup(app);
    if let Some(main) = app.get_webview_window(MAIN_WINDOW) {
        if let Ok(true) = main.is_minimized() {
            let _ = main.unminimize();
        }
        let _ = main.show();
        let _ = main.set_focus();
    }
}

pub fn handle_window_event(app: &AppHandle, label: &str, event: &WindowEvent) {
    match (label, event) {
        (MAIN_WINDOW, WindowEvent::CloseRequested { api, .. }) => {
            if cfg!(windows)
                && !app
                    .state::<AppState>()
                    .shutting_down
                    .load(Ordering::Acquire)
            {
                api.prevent_close();
                if let Some(main) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = main.hide();
                }
            }
        }
        (TRAY_WINDOW, WindowEvent::Focused(false)) => {
            // Windows shifts focus away from the popup on the next tray click.
            // Let the tray icon's mouse-up handler toggle it, rather than
            // hiding it early and reopening it on the same click.
            #[cfg(windows)]
            if cursor_over_tray_icon(app) {
                return;
            }
            hide_tray_popup(app);
        }
        _ => {}
    }
}

#[cfg(windows)]
fn cursor_over_tray_icon(app: &AppHandle) -> bool {
    let mut point = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut point) } == 0 {
        return false;
    }

    app.state::<AppState>()
        .tray_icon_bounds
        .lock()
        .ok()
        .and_then(|bounds| *bounds)
        .is_some_and(|bounds| contains_point(bounds, point.x, point.y))
}

#[cfg(windows)]
fn toggle_tray_popup(app: &AppHandle, cursor: PhysicalPosition<f64>, tray_bounds: tauri::Rect) {
    let Some(popup) = app.get_webview_window(TRAY_WINDOW) else {
        return;
    };
    let state = app.state::<AppState>();
    if state.tray_popup_visible.load(Ordering::Acquire) {
        hide_tray_popup(app);
        return;
    }

    let Ok(monitors) = popup.available_monitors() else {
        return;
    };
    let selected = monitors.iter().find(|monitor| {
        let area = monitor.position();
        let size = monitor.size();
        cursor.x >= f64::from(area.x)
            && cursor.x < f64::from(area.x) + f64::from(size.width)
            && cursor.y >= f64::from(area.y)
            && cursor.y < f64::from(area.y) + f64::from(size.height)
    });
    let Some(monitor) = selected.or_else(|| monitors.first()) else {
        return;
    };

    let scale = monitor.scale_factor();
    let width = (POPUP_WIDTH * scale).round() as i32;
    let height = (POPUP_HEIGHT * scale).round() as i32;
    let work = monitor.work_area();
    let left = work.position.x;
    let top = work.position.y;
    let right = left + work.size.width as i32;
    let bottom = top + work.size.height as i32;
    let tray_position = tray_bounds.position.to_physical::<i32>(scale);
    let tray_size = tray_bounds.size.to_physical::<u32>(scale);
    let tray_right = tray_position.x + tray_size.width as i32;
    let tray_bottom = tray_position.y + tray_size.height as i32;
    let overlap = (f64::from(POPUP_OVERLAP) * scale).round() as i32;

    if let Ok(mut bounds) = state.tray_icon_bounds.lock() {
        *bounds = Some(tray_click_area(
            (tray_position.x, tray_position.y, tray_right, tray_bottom),
            cursor,
        ));
    }

    let mut x = tray_right - width;
    let mut y = tray_position.y - height + overlap;
    if tray_position.y >= bottom {
        y = bottom - height;
    } else if tray_bottom <= top {
        y = top;
    } else if tray_position.x >= right {
        x = right - width;
        y = tray_bottom - height + overlap;
    } else if tray_right <= left {
        x = left;
        y = tray_bottom - height + overlap;
    }

    let x = x.clamp(left, right.saturating_sub(width).max(left));
    let y = y.clamp(top, bottom.saturating_sub(height).max(top));

    let _ = popup.set_position(Position::Physical(PhysicalPosition::new(x, y)));
    state.tray_popup_visible.store(true, Ordering::Release);
    let _ = popup.set_ignore_cursor_events(false);
    let _ = popup.emit("tray-popup-visibility", true);
    let _ = popup.set_focus();
}

fn hide_tray_popup(app: &AppHandle) {
    let state = app.state::<AppState>();
    if !state.tray_popup_visible.swap(false, Ordering::AcqRel) {
        return;
    }
    if let Some(popup) = app.get_webview_window(TRAY_WINDOW) {
        let _ = popup.emit("tray-popup-visibility", false);
        let _ = popup.set_ignore_cursor_events(true);
    }
}

#[cfg(windows)]
fn start_outside_click_monitor(app: AppHandle, hwnd: usize) {
    thread::spawn(move || {
        let mut mouse_was_down = false;
        loop {
            let state = app.state::<AppState>();
            if state.shutting_down.load(Ordering::Acquire) {
                break;
            }
            if !state.tray_popup_visible.load(Ordering::Acquire) {
                mouse_was_down = false;
                thread::sleep(Duration::from_millis(20));
                continue;
            }

            let mouse_is_down = unsafe {
                [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON]
                    .into_iter()
                    .any(|button| (GetAsyncKeyState(i32::from(button)) as u16 & 0x8000) != 0)
            };
            if mouse_is_down && !mouse_was_down {
                let mut point = POINT { x: 0, y: 0 };
                let mut bounds = RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                };
                let has_point = unsafe { GetCursorPos(&mut point) != 0 };
                let has_bounds = unsafe { GetWindowRect(hwnd as HWND, &mut bounds) != 0 };
                if has_point && has_bounds {
                    let inside_popup = point.x >= bounds.left
                        && point.x < bounds.right
                        && point.y >= bounds.top
                        && point.y < bounds.bottom;
                    let inside_tray = state
                        .tray_icon_bounds
                        .lock()
                        .ok()
                        .and_then(|bounds| *bounds)
                        .is_some_and(|bounds| contains_point(bounds, point.x, point.y));
                    if !inside_popup && !inside_tray {
                        hide_tray_popup(&app);
                    }
                }
            }
            mouse_was_down = mouse_is_down;
            thread::sleep(Duration::from_millis(10));
        }
    });
}

#[cfg(windows)]
pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let popup = WebviewWindowBuilder::new(app, TRAY_WINDOW, WebviewUrl::App("tray.html".into()))
        .title("TideStudio Tray")
        .inner_size(POPUP_WIDTH, POPUP_HEIGHT)
        .decorations(false)
        .transparent(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .shadow(false)
        .visible(true)
        .focused(false)
        .build()?;
    popup.set_ignore_cursor_events(true)?;
    let hwnd = popup.hwnd()?.0 as usize;
    start_outside_click_monitor(app.handle().clone(), hwnd);

    let icon = app
        .default_window_icon()
        .expect("TideStudio icon is configured")
        .clone();
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("TideStudio")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                position,
                rect,
                ..
            } = event
            {
                if button_state != MouseButtonState::Up {
                    return;
                }
                match button {
                    MouseButton::Left => show_main(tray.app_handle()),
                    MouseButton::Right => toggle_tray_popup(tray.app_handle(), position, rect),
                    _ => {}
                }
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg(not(windows))]
pub fn setup_tray(_app: &mut tauri::App) -> tauri::Result<()> {
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::{contains_point, tray_click_area};
    use tauri::PhysicalPosition;

    #[test]
    fn repeated_tray_clicks_do_not_count_as_outside_clicks() {
        // A tray event can report a zero-sized rectangle on the overflow surface.
        let bounds = tray_click_area((0, 0, 0, 0), PhysicalPosition::new(120.0, 300.0));
        assert!(contains_point(bounds, 120, 300));
        assert!(contains_point(bounds, 125, 305));
        assert!(!contains_point(bounds, 135, 310));
        assert!(!contains_point(bounds, 250, 300));
    }
}
