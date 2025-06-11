variable "aws_access_key" {
  description = "AWS Access Key"
  type        = string
  sensitive   = true
}

variable "aws_secret_key" {
  description = "AWS Secret Key"
  type        = string
  sensitive   = true
}

variable "docker_image" {
  description = "The Docker image to deploy to ECS (e.g., rafafrassetto/strapi-cms:latest)"
  type        = string
}
