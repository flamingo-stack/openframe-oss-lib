package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.nats.config.NotificationChannelExecutorConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins that dispatch() actually runs through the @Async proxy on the named executor — the pipeline IT
 * constructs the dispatcher with {@code new}, which bypasses the proxy. If the proxy is not applied
 * (or the executor bean cannot be resolved), broadcast() would block its caller for every channel's
 * network I/O in production.
 */
@SpringBootTest(classes = DispatchAsyncDetachmentTest.AsyncApp.class)
class DispatchAsyncDetachmentTest {

    @Autowired
    private NotificationChannelDispatcher dispatcher;
    @Autowired
    private RecordingChannel channel;

    @Test
    @DisplayName("dispatch() returns immediately and delivery runs on a virtual thread — the @Async proxy detaches the caller and the named executor resolves")
    void dispatch_is_detached_onto_a_virtual_thread() throws Exception {
        dispatcher.dispatch(Set.of("alice"),
                Notification.builder().id("n1").build(), NotificationCategory.TICKETS);

        assertThat(channel.latch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(channel.deliveredThread.get().isVirtual()).isTrue();
        assertThat(channel.deliveredThread.get()).isNotEqualTo(Thread.currentThread());
    }

    static class RecordingChannel implements NotificationChannel {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<Thread> deliveredThread = new AtomicReference<>();

        @Override
        public String name() {
            return "recording";
        }

        @Override
        public void deliver(String userId, Notification notification, NotificationCategory category) {
            deliveredThread.set(Thread.currentThread());
            latch.countDown();
        }
    }

    @SpringBootConfiguration
    @EnableAsync
    @Import({NotificationChannelExecutorConfig.class, NotificationChannelDispatcher.class})
    static class AsyncApp {

        @Bean
        RecordingChannel recordingChannel() {
            return new RecordingChannel();
        }
    }
}
