{
  "targets": [
    {
      "target_name": "vector_ops",
      "sources": ["vector_ops.cpp"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math", "-mavx512f", "-mavx512dq", "-mavx512bw", "-mavx512vl"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-mavx512f", "-mavx512dq", "-mavx512bw", "-mavx512vl"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "NAPI_VERSION=4",
        "__AVX512F__=1",
        "__AVX512DQ__=1",
        "__AVX512BW__=1",
        "__AVX512VL__=1"
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
            "CLANG_CXX_FLAGS": ["-O3", "-march=native", "-ffast-math", "-mavx512f", "-mavx512dq", "-mavx512bw", "-mavx512vl"]
          }
        }],
        ["OS=='linux'", {
          "cflags": ["-O3", "-march=native", "-ffast-math", "-fPIC", "-mavx512f", "-mavx512dq", "-mavx512bw", "-mavx512vl"],
          "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-fPIC", "-mavx512f", "-mavx512dq", "-mavx512bw", "-mavx512vl"]
        }]
      ]
    }
  ]
}
