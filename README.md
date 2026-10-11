# TideStudio

TideStudio is a desktop app for running and managing local models with [llama.cpp](https://github.com/ggml-org/llama.cpp).

I originally built it because I wanted a simple UI between me and llama.cpp without having to manage everything from the command line.

LM Studio already covers a lot of the same ground, but I wanted something I could maintain for myself and update on my own schedule, especially as llama.cpp keeps moving quickly. TideStudio is basically the workflow I wanted for my own machine, packaged into an app.

I'm sharing it because someone else might find it useful too.

## What it does

TideStudio gives you one place to:

- Search for and download GGUF models
- Manage models stored on your machine
- Load and unload models with llama.cpp
- Configure model load and inference settings
- Run multiple model workers
- Use OpenAI-compatible and Anthropic-compatible API endpoints
- Use just-in-time model loading and automatic unloading
- Configure supported speculative decoding features
- Switch between light and dark themes

Model search currently supports Hugging Face and ModelScope.

## Download

Prebuilt releases are available on the [Releases page](https://github.com/ceciliomichael/tidestudio/releases).

### Platform support

The current release supports:

- Windows x64

macOS and Linux builds are not available in the initial release.

## Getting started

1. Download the latest Windows installer from the Releases page.
2. Install and open TideStudio.
3. Download a GGUF model from Model Search, or place an existing model in your TideStudio models directory.
4. Load the model from the Server page.
5. Use it in TideStudio or connect another application to the local API server.

By default, models are stored in:

```text
%USERPROFILE%\.tidestudio\models
```

You can change the models directory from Settings.

## Why another llama.cpp UI?

Mostly because I wanted one for myself.

llama.cpp changes often, and I wanted control over which version I use and when I update it. TideStudio stays close to llama.cpp instead of trying to replace it. It is a desktop layer around the parts I use regularly: finding models, loading them, changing settings, and exposing them through a local API.

If that workflow fits how you use local models too, feel free to use it.

## Project status

TideStudio is still early and is mainly developed around my own day-to-day use.

Things may change between releases, and there will probably be bugs or rough edges. If you find something broken or have an idea, open an issue:

https://github.com/ceciliomichael/tidestudio/issues

## Credits

TideStudio relies heavily on [llama.cpp](https://github.com/ggml-org/llama.cpp) and the work of its contributors.

Model search and downloads use:

- [Hugging Face](https://huggingface.co/)
- [ModelScope](https://modelscope.cn/)

## License

TideStudio is released under the [MIT License](LICENSE).

Third-party projects and dependencies keep their own licenses.
