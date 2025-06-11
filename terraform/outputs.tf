output "strapi_alb_dns_name" {
  description = "The DNS name of the Strapi Application Load Balancer"
  value       = aws_lb.strapi_alb.dns_name
}

output "strapi_cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.strapi_cluster.name
}

output "strapi_service_name" {
  description = "The name of the ECS service"
  value       = aws_ecs_service.strapi_service.name
}
