package com.openframe.management.scheduler;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.publisher.OpenFrameClientUpdatePublisher;
import com.openframe.data.nats.publisher.ToolAgentUpdateUpdatePublisher;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The scheduler is a fallback publisher: one broken entity must never park the others until the next tick,
 * and the retry budget is the only thing stopping a permanently failing entity from being republished forever.
 */
@ExtendWith(MockitoExtension.class)
class AgentVersionUpdatePublishFallbackSchedulerUnitTest {

    private static final int MAX_ATTEMPTS = 5;

    @Mock
    private OpenFrameClientConfigurationService openFrameClientConfigurationService;
    @Mock
    private OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;
    @Mock
    private IntegratedToolAgentService integratedToolAgentService;
    @Mock
    private ToolAgentUpdateUpdatePublisher toolAgentUpdateUpdatePublisher;

    @InjectMocks
    private AgentVersionUpdatePublishFallbackScheduler scheduler;

    private void withMaxAttempts(int maxAttempts) {
        ReflectionTestUtils.setField(scheduler, "maxPublishAttempts", maxAttempts);
    }

    @Test
    @DisplayName("a failing agent does not stop the agents queued behind it")
    void failingAgentDoesNotAbortTheLoop() {
        withMaxAttempts(MAX_ATTEMPTS);
        when(openFrameClientConfigurationService.get()).thenReturn(publishedClient());

        IntegratedToolAgent bad = agent("agent-bad", PublishState.pending());
        IntegratedToolAgent good = agent("agent-good", PublishState.pending());
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(bad, good));
        doThrow(new RuntimeException("nats down")).when(toolAgentUpdateUpdatePublisher).publish(bad);

        assertThatCode(() -> scheduler.publishUnpublishedEntities()).doesNotThrowAnyException();

        verify(toolAgentUpdateUpdatePublisher).publish(bad);
        verify(toolAgentUpdateUpdatePublisher).publish(good);
    }

    @Test
    @DisplayName("a failing client config does not stop tool-agent publishing")
    void failingClientConfigDoesNotStopToolAgents() {
        withMaxAttempts(MAX_ATTEMPTS);
        when(openFrameClientConfigurationService.get()).thenThrow(new RuntimeException("mongo down"));

        IntegratedToolAgent agent = agent("agent-1", PublishState.pending());
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));

        assertThatCode(() -> scheduler.publishUnpublishedEntities()).doesNotThrowAnyException();

        verify(toolAgentUpdateUpdatePublisher).publish(agent);
    }

    @Test
    @DisplayName("a null publish state is treated as never published")
    void nullPublishStateIsRepublished() {
        withMaxAttempts(MAX_ATTEMPTS);
        OpenFrameClientConfiguration config = client(null);
        when(openFrameClientConfigurationService.get()).thenReturn(config);
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of());

        scheduler.publishUnpublishedEntities();

        verify(openFrameClientUpdatePublisher).publish(config);
    }

    @Test
    @DisplayName("an already published entity is not republished")
    void publishedEntityIsSkipped() {
        withMaxAttempts(MAX_ATTEMPTS);
        when(openFrameClientConfigurationService.get()).thenReturn(publishedClient());
        when(integratedToolAgentService.getAllEnabled())
                .thenReturn(List.of(agent("agent-1", PublishState.published())));

        scheduler.publishUnpublishedEntities();

        verify(openFrameClientUpdatePublisher, never()).publish(any());
        verify(toolAgentUpdateUpdatePublisher, never()).publish(any());
    }

    @Test
    @DisplayName("the retry budget is exhausted at maxPublishAttempts, not one attempt later")
    void retryBudgetStopsAtMaxAttempts() {
        withMaxAttempts(MAX_ATTEMPTS);
        when(openFrameClientConfigurationService.get())
                .thenReturn(client(new PublishState(false, MAX_ATTEMPTS)));
        when(integratedToolAgentService.getAllEnabled())
                .thenReturn(List.of(agent("agent-1", new PublishState(false, MAX_ATTEMPTS))));

        scheduler.publishUnpublishedEntities();

        verify(openFrameClientUpdatePublisher, never()).publish(any());
        verify(toolAgentUpdateUpdatePublisher, never()).publish(any());
    }

    @Test
    @DisplayName("the last attempt inside the budget is still published")
    void lastAttemptWithinBudgetIsPublished() {
        withMaxAttempts(MAX_ATTEMPTS);
        OpenFrameClientConfiguration config = client(new PublishState(false, MAX_ATTEMPTS - 1));
        IntegratedToolAgent agent = agent("agent-1", new PublishState(false, MAX_ATTEMPTS - 1));
        when(openFrameClientConfigurationService.get()).thenReturn(config);
        when(integratedToolAgentService.getAllEnabled()).thenReturn(List.of(agent));

        scheduler.publishUnpublishedEntities();

        verify(openFrameClientUpdatePublisher).publish(config);
        verify(toolAgentUpdateUpdatePublisher).publish(agent);
    }

    private static OpenFrameClientConfiguration publishedClient() {
        return client(PublishState.published());
    }

    private static OpenFrameClientConfiguration client(PublishState publishState) {
        OpenFrameClientConfiguration config = new OpenFrameClientConfiguration();
        config.setPublishState(publishState);
        return config;
    }

    private static IntegratedToolAgent agent(String id, PublishState publishState) {
        IntegratedToolAgent agent = new IntegratedToolAgent();
        agent.setId(id);
        agent.setPublishState(publishState);
        return agent;
    }
}
