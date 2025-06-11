variable "docker_image" {
  description = "The Docker image to deploy"
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_ecs_cluster" "strapi_cluster" {
  name = "strapi-cluster"
}