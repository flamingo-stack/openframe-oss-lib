package com.openframe.data.document.rmm.script;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collector;

import static java.util.stream.Collectors.toUnmodifiableMap;

public enum OsType {
    WINDOWS,
    MAC_OS;

    public static final Map<String, OsType> BY_NAME = indexByName();

    private static Map<String, OsType> indexByName() {
        OsType[] types = values();
        Collector<OsType, ?, Map<String, OsType>> byName = toUnmodifiableMap(OsType::name, type -> type);
        return Arrays.stream(types).collect(byName);
    }
}
