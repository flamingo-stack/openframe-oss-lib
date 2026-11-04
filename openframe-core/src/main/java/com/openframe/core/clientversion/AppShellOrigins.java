package com.openframe.core.clientversion;

import java.util.Map;
import java.util.Optional;

public final class AppShellOrigins {

    private static final Map<String, ClientKind> KINDS_BY_ORIGIN = Map.of(
            "capacitor://localhost", ClientKind.IOS,
            "https://localhost", ClientKind.ANDROID,
            "tauri://localhost", ClientKind.DESKTOP,
            "http://tauri.localhost", ClientKind.DESKTOP);

    private AppShellOrigins() {
    }

    public static Optional<ClientKind> kindOf(String origin) {
        return origin == null ? Optional.empty() : Optional.ofNullable(KINDS_BY_ORIGIN.get(origin));
    }
}
