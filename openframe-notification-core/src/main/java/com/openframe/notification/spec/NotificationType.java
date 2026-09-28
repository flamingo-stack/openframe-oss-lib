package com.openframe.notification.spec;

// Implemented by an enum next to each spec catalog (tenant, saas, oss) — the extensible-enum pattern.
// Only the name crosses process boundaries; the constant itself never rides the wire.
public interface NotificationType {

    String name();
}
