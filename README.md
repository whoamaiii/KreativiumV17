# Kreativium Beta v2

A comprehensive sensory tracking and analytics platform for special education professionals.

## About

This project was imported from the kreativiumbeta2 local development environment. It contains:

- **Dist folder**: Built application artifacts ready for deployment
- **MLX Backend**: Python backend for machine learning inference
- **Public folder**: Static assets and model configurations

## Project Structure

```
kreativiumbeta2/
├── dist/              # Built application
│   ├── assets/        # Bundled JavaScript and CSS
│   ├── models/        # Model configuration files
│   └── index.html     # Main application entry
├── mlx-backend/       # Python ML backend
│   └── models/        # MLX model files
└── public/            # Static assets
    └── models/        # Public model files
```

## Features

- **Sensory Tracking**: Comprehensive sensory input monitoring
- **Emotion Analytics**: Advanced emotion pattern analysis
- **AI Integration**: Gemma 3 270M model for insights
- **Report Generation**: Automated PDF reports
- **Real-time Analytics**: Live pattern detection

## Deployment

The `dist` folder contains the production-ready build that can be deployed to any static hosting platform.

## Configuration

Model configurations are stored in `dist/models/gemma3-270m-it/` with:
- `config.json` - Model configuration
- `tokenizer_config.json` - Tokenizer settings

## Notes

- Large binary files (*.onnx, *.bin, *.safetensors) are excluded from git
- WASM files are excluded due to size constraints
- Python virtual environment is excluded from git

## Original Project

This is a continuation of the KreativiumV17 project, representing the beta v2 iteration with enhanced ML capabilities and improved analytics.
