package com.openframe.data.document.tenant;

import java.util.Arrays;

/**
 * Enum representing available Openframe products.
 */
public enum OpenframeProduct {
    AI_ASSISTANCE,
    MANAGED_DEVICES;

    /**
     * Parse OpenframeProduct from string value.
     * @param value the string value (case-insensitive)
     * @return the corresponding OpenframeProduct enum
     * @throws IllegalArgumentException if value doesn't match any enum constant
     */
    public static OpenframeProduct fromValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("OpenframeProduct value cannot be null");
        }
        
        return Arrays.stream(OpenframeProduct.values())
                .filter(product -> product.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown OpenframeProduct: " + value));
    }
}
