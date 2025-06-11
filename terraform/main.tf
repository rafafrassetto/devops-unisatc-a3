variable "docker_image" {
  description = "The Docker image to deploy"
}

provider "aws" {
  region     = "us-east-1"
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

resource "aws_ecs_cluster" "strapi_cluster" {
  name = "strapi-cluster"
}