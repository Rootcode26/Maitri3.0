"""Offline unittest runner including the existing zero-argument function tests."""
import importlib.util
from pathlib import Path
import sys
import unittest


def main():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))
    sys.path.insert(0, str(root / 'tests'))
    suite = unittest.TestSuite()
    for index, path in enumerate(sorted((root / 'tests').rglob('test_*.py'))):
        spec = importlib.util.spec_from_file_location(f'relevant_test_{index}', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
        for name, value in sorted(vars(module).items()):
            if name.startswith('test_') and callable(value):
                suite.addTest(unittest.FunctionTestCase(value))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(main())
