using System;
using System.Runtime.InteropServices;

class InputSimulator {
    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("sas.dll", SetLastError = true)]
    static extern void SendSAS(bool fAsUser);

    // Structure definitions for SendInput API
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct HARDWAREINPUT {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;

    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
    const uint MOUSEEVENTF_WHEEL = 0x0800;

    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    static void Main() {
        EnableSoftwareSAS();
        Console.WriteLine("InputSimulator Ready");
        string line;
        while ((line = Console.ReadLine()) != null) {
            try {
                var parts = line.Trim().Split(new char[] { ' ' }, 2);
                if (parts.Length == 0 || string.IsNullOrEmpty(parts[0])) continue;
                var cmd = parts[0].ToLower();

                if (cmd == "move" && parts.Length >= 2) {
                    var coords = parts[1].Split(' ');
                    if (coords.Length >= 2) {
                        double pctX = double.Parse(coords[0], System.Globalization.CultureInfo.InvariantCulture);
                        double pctY = double.Parse(coords[1], System.Globalization.CultureInfo.InvariantCulture);

                        // Normalize absolute coordinates to the virtual desktop range [0, 65535]
                        int dx = (int)(pctX * 65535.0);
                        int dy = (int)(pctY * 65535.0);

                        INPUT[] inputs = new INPUT[1];
                        inputs[0] = new INPUT {
                            type = INPUT_MOUSE,
                            U = new InputUnion {
                                mi = new MOUSEINPUT {
                                    dx = dx,
                                    dy = dy,
                                    dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
                                    time = 0,
                                    dwExtraInfo = IntPtr.Zero
                                }
                            }
                        };
                        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                    }
                }
                else if (cmd == "down") {
                    INPUT[] inputs = new INPUT[1];
                    inputs[0] = new INPUT {
                        type = INPUT_MOUSE,
                        U = new InputUnion {
                            mi = new MOUSEINPUT {
                                dwFlags = MOUSEEVENTF_LEFTDOWN,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "up") {
                    INPUT[] inputs = new INPUT[1];
                    inputs[0] = new INPUT {
                        type = INPUT_MOUSE,
                        U = new InputUnion {
                            mi = new MOUSEINPUT {
                                dwFlags = MOUSEEVENTF_LEFTUP,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "rightdown") {
                    INPUT[] inputs = new INPUT[1];
                    inputs[0] = new INPUT {
                        type = INPUT_MOUSE,
                        U = new InputUnion {
                            mi = new MOUSEINPUT {
                                dwFlags = MOUSEEVENTF_RIGHTDOWN,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "rightup") {
                    INPUT[] inputs = new INPUT[1];
                    inputs[0] = new INPUT {
                        type = INPUT_MOUSE,
                        U = new InputUnion {
                            mi = new MOUSEINPUT {
                                dwFlags = MOUSEEVENTF_RIGHTUP,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "wheel" && parts.Length >= 2) {
                    int delta = int.Parse(parts[1]);
                    INPUT[] inputs = new INPUT[1];
                    inputs[0] = new INPUT {
                        type = INPUT_MOUSE,
                        U = new InputUnion {
                            mi = new MOUSEINPUT {
                                dwFlags = MOUSEEVENTF_WHEEL,
                                mouseData = unchecked((uint)delta),
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "paste") {
                    INPUT[] inputs = new INPUT[4];
                    // Ctrl Down
                    inputs[0] = new INPUT {
                        type = INPUT_KEYBOARD,
                        U = new InputUnion {
                            ki = new KEYBDINPUT {
                                wVk = 0x11,
                                wScan = 0,
                                dwFlags = KEYEVENTF_KEYDOWN,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    // V Down
                    inputs[1] = new INPUT {
                        type = INPUT_KEYBOARD,
                        U = new InputUnion {
                            ki = new KEYBDINPUT {
                                wVk = 0x56,
                                wScan = 0,
                                dwFlags = KEYEVENTF_KEYDOWN,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    // V Up
                    inputs[2] = new INPUT {
                        type = INPUT_KEYBOARD,
                        U = new InputUnion {
                            ki = new KEYBDINPUT {
                                wVk = 0x56,
                                wScan = 0,
                                dwFlags = KEYEVENTF_KEYUP,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    // Ctrl Up
                    inputs[3] = new INPUT {
                        type = INPUT_KEYBOARD,
                        U = new InputUnion {
                            ki = new KEYBDINPUT {
                                wVk = 0x11,
                                wScan = 0,
                                dwFlags = KEYEVENTF_KEYUP,
                                time = 0,
                                dwExtraInfo = IntPtr.Zero
                            }
                        }
                    };
                    SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT)));
                }
                else if (cmd == "sas" || cmd == "cad") {
                    try {
                        SendSAS(false);
                        Console.WriteLine("SAS Sent");
                    } catch (Exception ex) {
                        Console.Error.WriteLine("SAS Error: " + ex.Message);
                    }
                }
                else if (cmd == "key" && parts.Length >= 2) {
                    string keyVal = parts[1];
                    SendKeyString(keyVal);
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("Error: " + ex.Message);
            }
        }
    }

    static void SendKeyString(string keyVal) {
        if (keyVal.Length == 1) {
            // Send character as UNICODE input
            char c = keyVal[0];
            INPUT[] inputs = new INPUT[2];
            inputs[0] = new INPUT {
                type = INPUT_KEYBOARD,
                U = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = 0,
                        wScan = (ushort)c,
                        dwFlags = KEYEVENTF_UNICODE,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
            inputs[1] = new INPUT {
                type = INPUT_KEYBOARD,
                U = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = 0,
                        wScan = (ushort)c,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        }
        else {
            // Process special key names using Virtual Key Codes
            ushort vk = MapSpecialKeyToVk(keyVal);
            if (vk != 0) {
                INPUT[] inputs = new INPUT[2];
                inputs[0] = new INPUT {
                    type = INPUT_KEYBOARD,
                    U = new InputUnion {
                        ki = new KEYBDINPUT {
                            wVk = vk,
                            wScan = 0,
                            dwFlags = KEYEVENTF_KEYDOWN,
                            time = 0,
                            dwExtraInfo = IntPtr.Zero
                        }
                    }
                };
                inputs[1] = new INPUT {
                    type = INPUT_KEYBOARD,
                    U = new InputUnion {
                        ki = new KEYBDINPUT {
                            wVk = vk,
                            wScan = 0,
                            dwFlags = KEYEVENTF_KEYUP,
                            time = 0,
                            dwExtraInfo = IntPtr.Zero
                        }
                    }
                };
                SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            }
        }
    }

    static ushort MapSpecialKeyToVk(string keyName) {
        switch (keyName.ToLower()) {
            case "enter": return 0x0D;
            case "escape": return 0x1B;
            case "backspace": return 0x08;
            case "tab": return 0x09;
            case "space": return 0x20;
            case "arrowup": case "up": return 0x26;
            case "arrowdown": case "down": return 0x28;
            case "arrowleft": case "left": return 0x25;
            case "arrowright": case "right": return 0x27;
            case "delete": return 0x2E;
        }
        return 0;
    }

    static void EnableSoftwareSAS() {
        try {
            using (var key = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System", true)) {
                if (key != null) {
                    object val = key.GetValue("SoftwareSASGeneration");
                    if (val == null || (int)val != 3) {
                        key.SetValue("SoftwareSASGeneration", 3, Microsoft.Win32.RegistryValueKind.DWord);
                        Console.WriteLine("Software SAS generation enabled in registry.");
                    }
                }
            }
        } catch (Exception ex) {
            Console.Error.WriteLine("Registry Error (SAS): " + ex.Message);
        }
    }
}
