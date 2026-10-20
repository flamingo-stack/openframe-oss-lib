package com.openframe.publishing.repository;

// A custom method named like a delete: not intercepted, because only marked methods and derived deletes are.
public class DeleteNamedFragmentImpl implements DeleteNamedFragment {

    @Override
    public void deleteNamed(String name) {
        throw new UnsupportedOperationException("not called by the tests");
    }
}
