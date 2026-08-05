package com.openframe.core.util;

import org.junit.jupiter.api.Test;
import reactor.core.Exceptions;
import reactor.netty.channel.AbortedException;

import java.io.IOException;
import java.nio.channels.ClosedChannelException;

import static org.assertj.core.api.Assertions.assertThat;

class ClientDisconnectClassifierTest {

    @Test
    void shouldClassifyAbortedExceptionAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(AbortedException.beforeSend())).isTrue();
    }

    @Test
    void shouldClassifyClosedChannelExceptionAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(new ClosedChannelException())).isTrue();
    }

    @Test
    void shouldClassifyStacklessClosedChannelSubclassAsDisconnect() {
        ClosedChannelException stackless = new ClosedChannelException() {
        };
        assertThat(ClientDisconnectClassifier.isClientDisconnect(stackless)).isTrue();
    }

    @Test
    void shouldClassifyPrematureCloseExceptionAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(
                reactor.netty.http.client.PrematureCloseException.TEST_EXCEPTION)).isTrue();
    }

    @Test
    void shouldClassifyBrokenPipeIoExceptionAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(
                new IOException("sendAddress(..) failed: Broken pipe"))).isTrue();
    }

    @Test
    void shouldClassifyConnectionResetIoExceptionAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(
                new IOException("Connection reset by peer"))).isTrue();
    }

    @Test
    void shouldClassifyNestedDisconnectCause() {
        RuntimeException wrapped = new RuntimeException("outer",
                new IllegalStateException("mid", new IOException("Broken pipe")));
        assertThat(ClientDisconnectClassifier.isClientDisconnect(wrapped)).isTrue();
    }

    @Test
    void shouldUnwrapErrorCallbackNotImplemented() {
        Throwable dropped = Exceptions.errorCallbackNotImplemented(new IOException("Broken pipe"));
        assertThat(ClientDisconnectClassifier.isClientDisconnect(dropped)).isTrue();
    }

    @Test
    void shouldTerminateOnSelfReferentialCauseChain() {
        Exception selfCaused = new Exception("loop") {
            @Override
            public synchronized Throwable getCause() {
                return this;
            }
        };
        assertThat(ClientDisconnectClassifier.isClientDisconnect(selfCaused)).isFalse();
    }

    @Test
    void shouldTerminateOnTwoNodeCauseCycle() {
        Exception a = new Exception("a");
        Exception b = new Exception("b", a);
        a.initCause(b);
        assertThat(ClientDisconnectClassifier.isClientDisconnect(a)).isFalse();
    }

    @Test
    void shouldNotClassifyGenericErrorsAsDisconnect() {
        assertThat(ClientDisconnectClassifier.isClientDisconnect(new RuntimeException("boom"))).isFalse();
        assertThat(ClientDisconnectClassifier.isClientDisconnect(new IllegalStateException("bad state"))).isFalse();
        assertThat(ClientDisconnectClassifier.isClientDisconnect(new IOException("No space left on device"))).isFalse();
        assertThat(ClientDisconnectClassifier.isClientDisconnect(null)).isFalse();
    }
}
