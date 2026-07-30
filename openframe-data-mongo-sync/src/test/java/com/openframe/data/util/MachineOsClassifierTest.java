package com.openframe.data.util;

import com.openframe.data.document.rmm.ScriptPlatform;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class MachineOsClassifierTest {

    @Test
    @DisplayName("classify: canonical enum names map to themselves")
    void classify_canonical() {
        assertThat(MachineOsClassifier.classify("WINDOWS")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("MACOS")).contains(ScriptPlatform.MACOS);
    }

    @Test
    @DisplayName("classify: real agent-reported Windows shapes → WINDOWS (WINDOWS from Rust agent, plus short WIN/WIN32/WIN64 aliases)")
    void classify_windowsShapes() {
        assertThat(MachineOsClassifier.classify("WINDOWS")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("windows")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("winnt")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("WIN")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("win32")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("WIN64")).contains(ScriptPlatform.WINDOWS);
    }

    @Test
    @DisplayName("classify: Rust-agent shape 'MAC_OS' (with underscore) → MACOS — the regression that made every Mac invisible in the Available Devices picker before this fix")
    void classify_rustAgentMacOs_matches() {
        assertThat(MachineOsClassifier.classify("MAC_OS")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("mac_os")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("Mac_Os")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("MAC_OS_X")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("mac_os_x")).contains(ScriptPlatform.MACOS);
    }

    @Test
    @DisplayName("classify: separator variants of MACOS (dash, space, none) all resolve — canonical compare strips separators before match")
    void classify_macosSeparatorVariants() {
        assertThat(MachineOsClassifier.classify("MAC-OS")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("Mac-OS-X")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("MAC OS")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("mac os x")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("MacOSX")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("macosx")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("OS_X")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("os-x")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("OS X")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("darwin")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("Darwin")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("mac")).contains(ScriptPlatform.MACOS);
    }

    @Test
    @DisplayName("classify: null / blank / unknown OS strings → empty (caller preserves the raw value). Linux distros deliberately don't classify — the enum has only WINDOWS/MACOS.")
    void classify_unknown() {
        assertThat(MachineOsClassifier.classify(null)).isEmpty();
        assertThat(MachineOsClassifier.classify("")).isEmpty();
        assertThat(MachineOsClassifier.classify("   ")).isEmpty();
        assertThat(MachineOsClassifier.classify("solaris")).isEmpty();
        assertThat(MachineOsClassifier.classify("freebsd")).isEmpty();
        assertThat(MachineOsClassifier.classify("chromeos")).isEmpty();
        assertThat(MachineOsClassifier.classify("linux")).isEmpty();
        assertThat(MachineOsClassifier.classify("Ubuntu 22.04")).isEmpty();
    }

    @Test
    @DisplayName("classify: multi-word system-report strings do NOT classify — canonical compare is strict equality, and any embedded numbers or extra words break the match (Windows/macOS agents already normalise before send)")
    void classify_multiWordShapes_notMatched() {
        assertThat(MachineOsClassifier.classify("Windows 11")).isEmpty();
        assertThat(MachineOsClassifier.classify("Windows Server 2022")).isEmpty();
        assertThat(MachineOsClassifier.classify("macOS 14.6")).isEmpty();
        assertThat(MachineOsClassifier.classify("Mac OS X 10.14")).isEmpty();
    }

    @Test
    @DisplayName("classify: non-OS strings containing 'mac'/'windows' as a substring do NOT classify — hostnames like MacBook / iMac stay out of platform matching")
    void classify_substringFalsePositives_notMatched() {
        assertThat(MachineOsClassifier.classify("machine")).isEmpty();
        assertThat(MachineOsClassifier.classify("macaroni")).isEmpty();
        assertThat(MachineOsClassifier.classify("macro")).isEmpty();
        assertThat(MachineOsClassifier.classify("MacBook")).isEmpty();
        assertThat(MachineOsClassifier.classify("MacBookPro")).isEmpty();
        assertThat(MachineOsClassifier.classify("iMac")).isEmpty();
        assertThat(MachineOsClassifier.classify("macbook-pro-15")).isEmpty();
        assertThat(MachineOsClassifier.classify("windowship")).isEmpty();
        assertThat(MachineOsClassifier.classify("windowshopping")).isEmpty();
        assertThat(MachineOsClassifier.classify("twinkling")).isEmpty();
        assertThat(MachineOsClassifier.classify("darwinism")).isEmpty();
    }

    @Test
    @DisplayName("toMongoRegex: WINDOWS fragment matches every canonical + short alias case-insensitively — whole-string only")
    void toMongoRegex_windowsMatches() {
        Pattern p = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.WINDOWS), Pattern.CASE_INSENSITIVE);
        assertThat(p.matcher("WINDOWS").matches()).isTrue();
        assertThat(p.matcher("windows").matches()).isTrue();
        assertThat(p.matcher("winnt").matches()).isTrue();
        assertThat(p.matcher("WIN").matches()).isTrue();
        assertThat(p.matcher("WIN32").matches()).isTrue();
        assertThat(p.matcher("win64").matches()).isTrue();
    }

    @Test
    @DisplayName("toMongoRegex: MACOS fragment matches every separator variant we canonicalise — MAC_OS (Rust), Mac-OS, mac os, MacOSX, os_x, darwin — case-insensitively, whole-string")
    void toMongoRegex_macosMatches() {
        Pattern p = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.MACOS), Pattern.CASE_INSENSITIVE);
        assertThat(p.matcher("MACOS").matches()).isTrue();
        assertThat(p.matcher("MAC_OS").matches()).isTrue();
        assertThat(p.matcher("mac_os").matches()).isTrue();
        assertThat(p.matcher("Mac-OS").matches()).isTrue();
        assertThat(p.matcher("MAC OS").matches()).isTrue();
        assertThat(p.matcher("MAC_OS_X").matches()).isTrue();
        assertThat(p.matcher("mac-os-x").matches()).isTrue();
        assertThat(p.matcher("mac os x").matches()).isTrue();
        assertThat(p.matcher("MacOSX").matches()).isTrue();
        assertThat(p.matcher("OSX").matches()).isTrue();
        assertThat(p.matcher("OS_X").matches()).isTrue();
        assertThat(p.matcher("OS X").matches()).isTrue();
        assertThat(p.matcher("darwin").matches()).isTrue();
        assertThat(p.matcher("Darwin").matches()).isTrue();
        assertThat(p.matcher("mac").matches()).isTrue();
    }

    @Test
    @DisplayName("toMongoRegex: fragments are whole-string anchored — no cross-matches (darwin ≠ WINDOWS despite containing 'win'; hostnames don't sneak into MACOS)")
    void toMongoRegex_anchoredNoCrossMatch() {
        Pattern win = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.WINDOWS), Pattern.CASE_INSENSITIVE);
        Pattern mac = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.MACOS), Pattern.CASE_INSENSITIVE);

        // WINDOWS regex must not match MACOS-shaped or arbitrary strings containing "win"
        assertThat(win.matcher("darwin").matches()).isFalse();
        assertThat(win.matcher("MAC_OS").matches()).isFalse();
        assertThat(win.matcher("twin").matches()).isFalse();
        assertThat(win.matcher("swindler").matches()).isFalse();

        // MACOS regex must not match hostnames or arbitrary "mac"-containing strings
        assertThat(mac.matcher("machine").matches()).isFalse();
        assertThat(mac.matcher("macaroni").matches()).isFalse();
        assertThat(mac.matcher("MacBook").matches()).isFalse();
        assertThat(mac.matcher("darwinism").matches()).isFalse();
        assertThat(mac.matcher("WINDOWS").matches()).isFalse();
    }
}
