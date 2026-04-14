{
  "targets": [
    {
      "target_name": "simd",
      "sources": [
        "src/simd.cc",
        "src/vnni.cc",
        "src/vector_ops.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fPIC"],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": ["-mavx512f", "-mavx512vl", "-mavx512dq", "-mavx512bw", "-mavx512vnni"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15"
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/arch:AVX512"]
            }
          }
        }]
      ]
    },
    {
      "target_name": "memory",
      "sources": ["src/memory.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fPIC"]
    }
  ]
}
