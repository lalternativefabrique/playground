FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY apps/core ./apps/core
RUN cd apps/core && CGO_ENABLED=0 go build -o /out/core .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/core /core
USER nonroot
EXPOSE 4100
ENTRYPOINT ["/core"]
