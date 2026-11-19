package com.openframe.api.datafetcher.rmm;

import com.openframe.api.mapper.GraphQLOsUpdateMapper;
import com.openframe.api.mapper.OsUpdateMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OsUpdateWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(MachineRepository.class, () -> mock(MachineRepository.class))
            .withBean(TenantIdProvider.class, () -> mock(TenantIdProvider.class))
            .withBean(DeviceOsUpdateRepository.class, () -> mock(DeviceOsUpdateRepository.class))
            .withBean(DeviceOsUpdateHistoryRepository.class, () -> mock(DeviceOsUpdateHistoryRepository.class))
            .withUserConfiguration(OsUpdateDataFetcher.class, GraphQLOsUpdateMapper.class, OsUpdateService.class,
                    OsUpdateMapper.class);

    @Test
    void osUpdateFlagAbsent_nothingOfTheFeatureRuns() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(OsUpdateDataFetcher.class);
            assertThat(context).doesNotHaveBean(GraphQLOsUpdateMapper.class);
            assertThat(context).doesNotHaveBean(OsUpdateService.class);
            assertThat(context).doesNotHaveBean(OsUpdateMapper.class);
        });
    }

    @Test
    void osUpdateFlagFalse_nothingOfTheFeatureRuns() {
        runner.withPropertyValues("openframe.rmm.os-update.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean(OsUpdateDataFetcher.class);
                    assertThat(context).doesNotHaveBean(OsUpdateService.class);
                });
    }

    @Test
    void osUpdateFlagOn_allOfItRuns() {
        runner.withPropertyValues("openframe.rmm.os-update.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(OsUpdateDataFetcher.class);
                    assertThat(context).hasSingleBean(GraphQLOsUpdateMapper.class);
                    assertThat(context).hasSingleBean(OsUpdateService.class);
                    assertThat(context).hasSingleBean(OsUpdateMapper.class);
                });
    }
}
