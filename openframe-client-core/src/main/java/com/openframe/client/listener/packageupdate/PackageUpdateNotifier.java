package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;

public interface PackageUpdateNotifier {

    void prompt(PackageUpdateRequest request, PackageUpdateDeviceState state);

    void countdown(PackageUpdateRequest request, PackageUpdateDeviceState state);

    void updateFailed(PackageUpdateRequest request, PackageUpdateDeviceState state);

    void autoUpdateFailed(PackageUpdateRequest request, PackageUpdateDeviceState state);
}
