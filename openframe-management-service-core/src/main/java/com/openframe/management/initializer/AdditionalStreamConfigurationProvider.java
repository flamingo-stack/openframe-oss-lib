package com.openframe.management.initializer;

import io.nats.client.api.StreamConfiguration;

import java.util.List;

public interface AdditionalStreamConfigurationProvider {

    List<StreamConfiguration> provide();
}
