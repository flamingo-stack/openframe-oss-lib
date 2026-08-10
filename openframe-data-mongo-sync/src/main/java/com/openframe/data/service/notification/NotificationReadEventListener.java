package com.openframe.data.service.notification;

/**
 * SPI for reacting to persisted read-state transitions (push retraction, live web updates, …).
 * Called synchronously after the write — implementations must return quickly or hand off to their
 * own async machinery. A throwing listener is logged and skipped: it can affect neither the
 * mutation result nor the other listeners.
 */
public interface NotificationReadEventListener {

    void onReadStateChanged(NotificationReadEvent event);
}
