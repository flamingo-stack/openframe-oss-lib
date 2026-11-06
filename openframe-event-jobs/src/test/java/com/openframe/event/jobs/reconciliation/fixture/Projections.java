package com.openframe.event.jobs.reconciliation.fixture;

import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.spec.PublishedEvent;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Mock projections for the tests that need only a projection's name.
public final class Projections {

    private Projections() {
    }

    @SuppressWarnings("unchecked")
    public static Projection<?, ?> named(String name) {
        Projection<PublishedEvent, Object> projection = mock(Projection.class);
        when(projection.name()).thenReturn(name);
        return projection;
    }
}
