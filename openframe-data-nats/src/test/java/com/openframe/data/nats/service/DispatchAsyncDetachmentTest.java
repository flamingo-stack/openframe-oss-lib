package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.nats.config.NotificationChannelExecutorConfig;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pins that dispatch() actually runs through the @Async proxy on the named executor — the pipeline IT
 * constructs the dispatcher with {@code new}, which bypasses the proxy. If the proxy is not applied
 * (or the executor bean cannot be resolved), broadcast() would block its caller for the whole grace
 * window in production.
 */
@SpringBootTest(classes = DispatchAsyncDetachmentTest.AsyncApp.class)
@TestPropertySource(properties = "openframe.push.web-grace-seconds=1")
class DispatchAsyncDetachmentTest {

    @Autowired
    private NotificationChannelDispatcher dispatcher;
    @Autowired
    private RecordingChannel channel;

    @Test
    @DisplayName("dispatch() returns immediately and delivery runs ~1s later on a virtual thread — the @Async proxy detaches the caller and the named executor resolves")
    void dispatch_is_detached_onto_a_virtual_thread() throws Exception {
        long startNanos = System.nanoTime();
        dispatcher.dispatch(Set.of("alice"),
                Notification.builder().id("n1").build(), NotificationCategory.TICKETS);
        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;

        assertThat(elapsedMs).as("caller must not block for the 1s grace window").isLessThan(500);
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

        @Bean
        NotificationReadStateService readStateService() {
            NotificationReadStateService service = mock(NotificationReadStateService.class);
            NotificationReadState unread = new NotificationReadState();
            unread.setRecipientId("alice");
            unread.setRecipientType(RecipientType.USER);
            unread.setStatus(ReadStatus.UNREAD);
            when(service.findRecipients(anyString())).thenReturn(List.of(unread));
            return service;
        }
    }
}
