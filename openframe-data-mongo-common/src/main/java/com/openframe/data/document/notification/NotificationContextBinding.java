package com.openframe.data.document.notification;

/**
 * SPI for downstream modules to register a {@link NotificationContext} subclass.
 * Beans are collected into the Jackson {@code SimpleModule} that drives
 * polymorphic (de)serialisation.
 *
 * <p>{@link GenericContext} is the {@code @JsonTypeInfo(defaultImpl = ...)}
 * fallback and is not registered via this SPI.
 */
public interface NotificationContextBinding {

    /** Must match the {@code type} value the producer sets on the context instance. */
    String type();

    /** Concrete subclass; needs a no-arg constructor for Jackson. */
    Class<? extends NotificationContext> contextClass();
}
