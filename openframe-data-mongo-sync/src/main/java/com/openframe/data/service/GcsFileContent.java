package com.openframe.data.service;

import lombok.Value;

/** Keeps downloaded bytes and their generation together for verified promotion. */
@Value
public class GcsFileContent {
    byte[] content;
    long generation;
}
