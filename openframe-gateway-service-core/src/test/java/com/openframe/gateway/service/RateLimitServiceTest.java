package com.openframe.gateway.service;

import com.openframe.data.repository.redis.ReactiveRateLimitRepository;
import com.openframe.data.repository.redis.ReactiveRateLimitRepository.RateLimitResult;
import com.openframe.gateway.config.prop.RateLimitProperties;
import com.openframe.gateway.model.RateLimitStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RateLimitServiceTest {

    private final ReactiveRateLimitRepository repository = mock(ReactiveRateLimitRepository.class);
    private final RateLimitProperties properties = new RateLimitProperties();
    private RateLimitService service;

    @BeforeEach
    void setUp() {
        properties.setEnabled(true);
        properties.setDefaultRequestsPerMinute(60);
        properties.setDefaultRequestsPerHour(1000);
        properties.setDefaultRequestsPerDay(10000);
        service = new RateLimitService(properties, repository);
        ReflectionTestUtils.setField(service, "redisTtl", 60L);
        ReflectionTestUtils.setField(service, "failOpen", false);
    }

    private static RateLimitResult result(boolean allowed, long count, long limit) {
        return RateLimitResult.builder().allowed(allowed).currentCount(count).limit(limit).remaining(Math.max(0, limit - count)).build();
    }

    private void windows(RateLimitResult minute, RateLimitResult hour, RateLimitResult day) {
        when(repository.checkAndIncrement(anyString(), eq("MINUTE"), anyString(), anyLong(), any(), any())).thenReturn(Mono.just(minute));
        when(repository.checkAndIncrement(anyString(), eq("HOUR"), anyString(), anyLong(), any(), any())).thenReturn(Mono.just(hour));
        when(repository.checkAndIncrement(anyString(), eq("DAY"), anyString(), anyLong(), any(), any())).thenReturn(Mono.just(day));
    }

    @Test
    void shouldAllowWhenEveryWindowHasRoom() {
        windows(result(true, 1, 60), result(true, 1, 1000), result(true, 1, 10000));

        assertThat(service.isAllowed("ak_1", "t").block()).isTrue();
    }

    @Test
    void shouldDenyWhenAnySingleWindowIsExhausted() {
        windows(result(true, 1, 60), result(false, 1001, 1000), result(true, 1, 10000));

        assertThat(service.isAllowed("ak_1", "t").block()).isFalse();
    }

    @Test
    void shouldCountPerKeyAndTenantWithConfiguredLimitsAndTtlAtLeastTwoWindows() {
        windows(result(true, 1, 60), result(true, 1, 1000), result(true, 1, 10000));

        service.isAllowed("ak_1", "tenant-a").block();

        verify(repository).checkAndIncrement(eq("ak_1"), eq("MINUTE"), anyString(), eq(60L), eq(Duration.ofSeconds(120)), eq("tenant-a"));
        verify(repository).checkAndIncrement(eq("ak_1"), eq("HOUR"), anyString(), eq(1000L), eq(Duration.ofSeconds(7200)), eq("tenant-a"));
        verify(repository).checkAndIncrement(eq("ak_1"), eq("DAY"), anyString(), eq(10000L), eq(Duration.ofSeconds(172800)), eq("tenant-a"));
    }

    @Test
    void shouldSkipRedisWhenRateLimitingIsDisabled() {
        properties.setEnabled(false);

        assertThat(service.isAllowed("ak_1", "t").block()).isTrue();
        verifyNoInteractions(repository);
    }

    @Test
    void shouldFailClosedWhenRedisFailsAndFailOpenIsOff() {
        when(repository.checkAndIncrement(anyString(), anyString(), anyString(), anyLong(), any(), any()))
                .thenReturn(Mono.error(new IllegalStateException("redis down")));

        assertThat(service.isAllowed("ak_1", "t").block()).isFalse();
    }

    @Test
    void shouldFailOpenWhenConfigured() {
        ReflectionTestUtils.setField(service, "failOpen", true);
        when(repository.checkAndIncrement(anyString(), anyString(), anyString(), anyLong(), any(), any()))
                .thenReturn(Mono.error(new IllegalStateException("redis down")));

        assertThat(service.isAllowed("ak_1", "t").block()).isTrue();
    }

    @Test
    void shouldReportStatusPerWindow() {
        when(repository.getStatus(anyString(), eq("MINUTE"), anyString(), anyLong(), any())).thenReturn(Mono.just(result(false, 61, 60)));
        when(repository.getStatus(anyString(), eq("HOUR"), anyString(), anyLong(), any())).thenReturn(Mono.just(result(true, 61, 1000)));
        when(repository.getStatus(anyString(), eq("DAY"), anyString(), anyLong(), any())).thenReturn(Mono.just(result(true, 61, 10000)));

        RateLimitStatus status = service.getRateLimitStatus("ak_1", "t").block();

        assertThat(status.minuteRequests()).isEqualTo(61);
        assertThat(status.minuteLimit()).isEqualTo(60);
        assertThat(status.isMinuteExceeded()).isTrue();
        assertThat(status.isHourExceeded()).isFalse();
        assertThat(status.dayLimit()).isEqualTo(10000);
    }

    @Test
    void shouldReportZeroUsageWhenStatusLookupFails() {
        when(repository.getStatus(anyString(), anyString(), anyString(), anyLong(), any()))
                .thenReturn(Mono.error(new IllegalStateException("redis down")));

        RateLimitStatus status = service.getRateLimitStatus("ak_1", "t").block();

        assertThat(status.minuteRequests()).isZero();
        assertThat(status.minuteLimit()).isEqualTo(60);
    }
}
