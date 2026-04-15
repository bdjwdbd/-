{
  "targets": [
    {
      "target_name": "vector_ops",
      "sources": ["vector_ops.cpp"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "NAPI_VERSION=4"
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": ["WIN32"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "CLANG_CXX_FLAGS": ["-O3", "-march=native", "-ffast-math"]
          }
        }],
        ["OS=='linux'", {
          "cflags": ["-O3", "-march=native", "-ffast-math", "-fPIC"],
          "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-fPIC"]
        }]
      ]
    }
  ]
}
