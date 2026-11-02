package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.PackageUpdateSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareAutoUpdateInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import lombok.experimental.UtilityClass;

import java.time.Duration;

@UtilityClass
public class PackageUpdateSettingsMapper {

    static final long DEFAULT_DEADLINE_SECONDS = Duration.ofDays(7).toSeconds();
    static final int DEFAULT_COUNTDOWN_SECONDS = (int) Duration.ofMinutes(5).toSeconds();

    public PackageUpdateSettings updateSettings(SoftwareAction action, PackageUpdateSettingsInput input) {
        if (action != SoftwareAction.UPDATE) {
            rejectOutsideUpdate(input, "updateSettings");
            return null;
        }
        return input == null ? defaults() : toDomain(input);
    }

    public SoftwareAutoUpdate autoUpdate(SoftwareAction action, SoftwareAutoUpdateInput input) {
        if (action != SoftwareAction.UPDATE) {
            rejectOutsideUpdate(input, "autoUpdate");
            return null;
        }
        if (input == null || !input.getEnabled()) {
            return SoftwareAutoUpdate.builder().enabled(false).build();
        }
        PackageUpdateSettings settings = input.getSettings() == null ? null : toDomain(input.getSettings());
        return SoftwareAutoUpdate.builder().enabled(true).settings(settings).build();
    }

    private PackageUpdateSettings defaults() {
        return PackageUpdateSettings.builder()
                .mode(PackageUpdateMode.WAIT)
                .deadlineSeconds(DEFAULT_DEADLINE_SECONDS)
                .countdownSeconds(DEFAULT_COUNTDOWN_SECONDS)
                .build();
    }

    private PackageUpdateSettings toDomain(PackageUpdateSettingsInput input) {
        PackageUpdateMode mode = input.getMode();
        Long deadlineSeconds = mode == PackageUpdateMode.FORCE ? null : input.getDeadlineSeconds();
        return PackageUpdateSettings.builder()
                .mode(mode)
                .deadlineSeconds(deadlineSeconds)
                .countdownSeconds(input.getCountdownSeconds())
                .build();
    }

    private void rejectOutsideUpdate(Object input, String field) {
        if (input != null) {
            throw new BadRequestException(field + " applies to UPDATE only: an app that is not installed yet cannot be running");
        }
    }
}
