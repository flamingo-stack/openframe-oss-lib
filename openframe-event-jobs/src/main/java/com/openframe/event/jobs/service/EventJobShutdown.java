package com.openframe.event.jobs.service;

import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextClosedEvent;

// Spring stops a running @Scheduled task without interrupting it, so a tick asks this between batches.
public class EventJobShutdown implements ApplicationListener<ContextClosedEvent> {

    private volatile boolean stopping;

    @Override
    public void onApplicationEvent(ContextClosedEvent event) {
        stopping = true;
    }

    public boolean isStopping() {
        return stopping || Thread.currentThread().isInterrupted();
    }
}
