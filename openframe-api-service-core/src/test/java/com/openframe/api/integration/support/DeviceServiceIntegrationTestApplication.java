package com.openframe.api.integration.support;

import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import org.mockito.Mockito;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.machine.MachineWriter;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Test context for {@link DeviceService} integration tests: the machines + tags repositories and the
 * service itself, against a real MongoDB. Guards the device-query building (filter + platform scope)
 * that only misbehaves against a real driver. {@link DeviceStatusProcessor} is a no-op stub.
 */
@SpringBootConfiguration
@ImportAutoConfiguration({
        MongoAutoConfiguration.class,
        MongoDataAutoConfiguration.class,
        MongoRepositoriesAutoConfiguration.class,
        JacksonAutoConfiguration.class
})
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = {MachineRepository.class, TagRepository.class})
@Import({
        CustomMachineRepositoryImpl.class,
        MachineWriter.class,
        DeviceService.class
})
public class DeviceServiceIntegrationTestApplication {

    @Bean
    DeviceStatusProcessor deviceStatusProcessor() {
        return machine -> { /* no-op for tests */ };
    }

    @Bean
    ScheduleScriptDeviceService scriptScheduleDeviceService() {
        return Mockito.mock(ScheduleScriptDeviceService.class);
    }

    @Bean
    DeviceFilterOptionMapper deviceFilterOptionMapper() {
        return Mockito.mock(DeviceFilterOptionMapper.class);
    }
}
