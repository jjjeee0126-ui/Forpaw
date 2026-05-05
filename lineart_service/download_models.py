from .pipeline import LineArtPipeline


if __name__ == "__main__":
    pipeline = LineArtPipeline()
    status = pipeline.warmup()
    print(status)
