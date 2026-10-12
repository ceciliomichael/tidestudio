mod commands;
mod core;
mod tray;

use core::{
    backends::llama_cpp::LlamaCppBackend, downloads::DownloadCancellation, gateway::GatewayManager,
    servers::ServerRegistry,
};
use std::sync::{Arc, Mutex, atomic::AtomicBool};
use tauri::RunEvent;

pub struct AppState {
    pub downloads: Arc<DownloadCancellation>,
    pub servers: Mutex<ServerRegistry>,
    pub gateway: Mutex<GatewayManager>,
    pub gateway_port: Mutex<u16>,
    pub shutting_down: AtomicBool,
    pub tray_popup_visible: AtomicBool,
    pub tray_icon_bounds: Mutex<Option<(i32, i32, i32, i32)>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            downloads: Arc::new(DownloadCancellation::default()),
            servers: Mutex::new(ServerRegistry::new(Box::new(LlamaCppBackend))),
            gateway: Mutex::new(GatewayManager::default()),
            gateway_port: Mutex::new(3456),
            shutting_down: AtomicBool::new(false),
            tray_popup_visible: AtomicBool::new(false),
            tray_icon_bounds: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|arg| arg == "--quit-for-install") {
                // WM_COPYDATA invokes this callback synchronously. Defer the exit
                // until the second instance has finished forwarding its request.
                let app_to_close = app.clone();
                let _ = app.run_on_main_thread(move || tray::quit_app(app_to_close));
            } else {
                tray::show_main(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let stored = commands::preferences::get_ui_preference_sync(
                app.handle(),
                core::paths::MODEL_STORAGE_PREFERENCE_KEY,
            )
            .map_err(std::io::Error::other)?;
            core::paths::initialize_models_dir(stored.as_deref()).map_err(std::io::Error::other)?;
            let llama_preference = commands::preferences::get_ui_preference_sync(
                app.handle(),
                core::runtimes::LLAMA_PREFERENCE_KEY,
            )
            .map_err(std::io::Error::other)?;
            let prism_preference = commands::preferences::get_ui_preference_sync(
                app.handle(),
                core::runtimes::PRISM_PREFERENCE_KEY,
            )
            .map_err(std::io::Error::other)?;
            core::runtimes::initialize_preferences(
                llama_preference.as_deref(),
                prism_preference.as_deref(),
            )
            .map_err(std::io::Error::other)?;
            commands::jit::start_controller(app.handle().clone());
            tray::setup_tray(app)?;
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::downloads::search_huggingface_models,
            commands::downloads::huggingface_model_files,
            commands::downloads::download_huggingface_file,
            commands::downloads::search_modelscope_models,
            commands::downloads::modelscope_model_files,
            commands::downloads::download_modelscope_file,
            commands::downloads::stop_model_download,
            commands::models::list_models,
            commands::models::get_models_directory,
            commands::models::set_models_directory,
            commands::models::reset_models_directory,
            commands::models::load_model_settings,
            commands::models::save_model_settings,
            commands::models::delete_model,
            commands::runtimes::get_runtimes,
            commands::runtimes::get_runtime_preferences,
            commands::runtimes::set_preferred_runtime,
            commands::runtimes::install_inference_runtime,
            commands::runtimes::cancel_inference_runtime_install,
            commands::runtimes::remove_inference_runtime,
            commands::preferences::get_ui_preference,
            commands::preferences::set_ui_preference,
            commands::preferences::get_completed_downloads,
            commands::preferences::save_completed_download,
            commands::preferences::clear_completed_downloads,
            commands::window::set_native_caption_color,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::update_server_inference,
            commands::server::list_servers,
            commands::server::server_status,
            commands::server::server_logs,
            commands::server::configure_gateway,
            commands::server::configure_gateway_background,
            commands::server::gateway_status,
            tray::toggle_window,
            tray::tray_popup_visible,
            tray::quit_app,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build TideStudio")
        .run(|app, event| match event {
            RunEvent::WindowEvent { label, event, .. } => {
                tray::handle_window_event(app, &label, &event);
            }
            RunEvent::ExitRequested { .. } | RunEvent::Exit => tray::shutdown(app),
            _ => {}
        });
}
