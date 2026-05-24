set shell := ["zsh", "-cu"]

default:
	just --list

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

preview:
	pnpm preview

lint:
	pnpm astro check

info:
	pnpm astro info

clean:
	rm -rf dist .astro
