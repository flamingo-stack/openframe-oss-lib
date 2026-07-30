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
    @DisplayName("classify: real agent-reported Windows shapes → WINDOWS")
    void classify_windowsShapes() {
        assertThat(MachineOsClassifier.classify("Windows 11")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("Windows Server 2022")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("Microsoft Windows 10")).contains(ScriptPlatform.WINDOWS);
        assertThat(MachineOsClassifier.classify("windows")).contains(ScriptPlatform.WINDOWS);
    }

    @Test
    @DisplayName("classify: real agent-reported macOS shapes (incl. Rust's 'darwin') → MACOS")
    void classify_macosShapes() {
        assertThat(MachineOsClassifier.classify("darwin")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("Mac OS X 10.14")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("macOS 14.6")).contains(ScriptPlatform.MACOS);
        assertThat(MachineOsClassifier.classify("osx")).contains(ScriptPlatform.MACOS);
    }

    @Test
    @DisplayName("classify: null / blank / unknown OS strings → empty (caller preserves the raw value). Linux is intentionally unclassified — not a supported platform.")
    void classify_unknown() {
        assertThat(MachineOsClassifier.classify(null)).isEmpty();
        assertThat(MachineOsClassifier.classify("")).isEmpty();
        assertThat(MachineOsClassifier.classify("   ")).isEmpty();
        assertThat(MachineOsClassifier.classify("solaris")).isEmpty();
        assertThat(MachineOsClassifier.classify("freebsd")).isEmpty();
        assertThat(MachineOsClassifier.classify("chromeos")).isEmpty();
        // Linux distros deliberately don't classify — the ScriptPlatform enum has only WINDOWS/MACOS.
        assertThat(MachineOsClassifier.classify("linux")).isEmpty();
        assertThat(MachineOsClassifier.classify("Ubuntu 22.04")).isEmpty();
    }

    @Test
    @DisplayName("toMongoRegex: WINDOWS fragment matches canonical + raw agent variants (case-insensitive)")
    void toMongoRegex_windowsMatches() {
        Pattern p = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.WINDOWS), Pattern.CASE_INSENSITIVE);
        assertThat(p.matcher("Windows 11").find()).isTrue();
        assertThat(p.matcher("WINDOWS").find()).isTrue();
        assertThat(p.matcher("windows").find()).isTrue();
    }

    @Test
    @DisplayName("toMongoRegex: MACOS fragment matches 'darwin' / 'macOS'/ 'Mac OS X' / canonical")
    void toMongoRegex_macosMatches() {
        Pattern p = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.MACOS), Pattern.CASE_INSENSITIVE);
        assertThat(p.matcher("darwin").find()).isTrue();
        assertThat(p.matcher("macOS 14").find()).isTrue();
        assertThat(p.matcher("Mac OS X").find()).isTrue();
        assertThat(p.matcher("MACOS").find()).isTrue();
    }

    @Test
    @DisplayName("toMongoRegex: WINDOWS fragment does NOT match a macOS raw value — no accidental cross-matches (darwin contains 'win' as substring)")
    void toMongoRegex_noCrossMatch() {
        Pattern win = Pattern.compile(MachineOsClassifier.toMongoRegex(ScriptPlatform.WINDOWS), Pattern.CASE_INSENSITIVE);
        assertThat(win.matcher("darwin").find()).isFalse();
        assertThat(win.matcher("macOS 14").find()).isFalse();
    }
}
