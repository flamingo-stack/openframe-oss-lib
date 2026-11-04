package com.openframe.core.clientversion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class AppShellOriginsTest {

    @ParameterizedTest
    @CsvSource({
            "capacitor://localhost,  IOS",
            "https://localhost,      ANDROID",
            "tauri://localhost,      DESKTOP",
            "http://tauri.localhost, DESKTOP"
    })
    void kindOf_appShellOrigin_returnsItsKind(String origin, ClientKind kind) {
        assertThat(AppShellOrigins.kindOf(origin)).contains(kind);
    }

    @Test
    void kindOf_webOrigin_returnsEmpty() {
        assertThat(AppShellOrigins.kindOf("https://openframe.ai")).isEmpty();
    }

    @Test
    void kindOf_noOrigin_returnsEmpty() {
        assertThat(AppShellOrigins.kindOf(null)).isEmpty();
    }
}
