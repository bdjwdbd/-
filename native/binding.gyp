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
          "cflags_cc": ["-mavx2", "-mfma", "-mavx512f", "-mavx512dq", "-mavx512vl"]
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
      "target_name": "hnsw",
      "sources": ["src/hnsw.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fPIC", "-O3", "-pthread"],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": ["-mavx2", "-mfma", "-pthread"],
          "libraries": ["-lpthread"]
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
      "target_name": "parallel",
      "sources": ["src/parallel.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fPIC", "-O3", "-fopenmp"],
      "libraries": ["-fopenmp"],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": ["-mavx2", "-mfma", "-fopenmp"],
          "libraries": ["-fopenmp"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15"
          },
          "libraries": ["-lomp"]
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/arch:AVX2", "/openmp"]
            }
          }
        }]
      ]
    },
    {
      "target_name": "int8",
      "sources": ["src/int8.cc"],
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
