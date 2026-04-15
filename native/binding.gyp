{
  "targets": [
    {
      "target_name": "yuanling_native",
      "sources": [
        "src/simd.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fPIC", "-O3"],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": ["-mavx2", "-mfma"]
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
              "AdditionalOptions": ["/arch:AVX2"]
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
      "cflags_cc": ["-std=c++17", "-fPIC", "-O3"]
    }
  ]
}
