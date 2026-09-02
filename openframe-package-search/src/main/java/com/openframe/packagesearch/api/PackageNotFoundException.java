package com.openframe.packagesearch.api;

import com.openframe.core.exception.NotFoundException;

public class PackageNotFoundException extends NotFoundException {

    public PackageNotFoundException(String packageId) {
        super("package not found: " + packageId);
    }
}
